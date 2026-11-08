// flair-metal-hash: 0b8089ba
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uPerspective;
    float uShine;
    float uShadow;
    float uCorner;
    packed_float3 uEdge;
    float uHold;
    uint uDemo;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_card_flip_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _118)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_118.uBackdrop) * _118.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_118.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _118)
{
    float4 _260;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _260 = overBackdrop(param, _118);
    }
    else
    {
        float2 param_1 = fract(uv);
        _260 = float4(testCard(param_1), 1.0);
    }
    return _260;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _118)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _118).xyz;
}

static inline __attribute__((always_inline))
float3 face(texture2d<float> tex, sampler texSmplr, thread const float2& cuv, thread const float& aspect, constant FlairUniforms& _118)
{
    float2 ts = float2(int2(tex.get_width(), tex.get_height()));
    float imageAspect = ts.x / fast::max(ts.y, 1.0);
    float2 _326;
    if (imageAspect > aspect)
    {
        _326 = float2(aspect / imageAspect, 1.0);
    }
    else
    {
        _326 = float2(1.0, imageAspect / aspect);
    }
    float2 fit = _326;
    float2 param = float2(0.5) + ((cuv - float2(0.5)) * fit);
    return picture(tex, texSmplr, param, _118);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _118, texture2d<float> uFront, sampler uFrontSmplr, texture2d<float> uBack, sampler uBackSmplr)
{
    float2 res = float2(_118.iResolution[0], _118.iResolution[1]);
    float h = fast::min(res.y * 0.7799999713897705078125, (res.x * 0.7799999713897705078125) / 0.716000020503997802734375);
    float demo = 0.0;
    if (_118.uDemo != 0u)
    {
        float c = mod(_118.iTime, 2.0 * _118.uHold) / _118.uHold;
        float f = fast::min(0.699999988079071044921875 / _118.uHold, 0.5);
        float _392;
        if (c < 1.0)
        {
            _392 = smoothstep(1.0 - f, 1.0, c);
        }
        else
        {
            _392 = 1.0 - smoothstep(2.0 - f, 2.0, c);
        }
        demo = _392;
    }
    float p = smoothstep(0.0, 1.0, mix(demo, 1.0, fast::clamp(_118.iPointer.z, 0.0, 1.0)));
    float turn = 3.1415927410125732421875 * p;
    float c_1 = cos(turn);
    float sn = sin(turn);
    float unit = (h * 0.5) * (1.0 + (0.0599999986588954925537109375 * sn));
    float2 sp = (fragCoord - (res * 0.5)) / float2(unit);
    float D = mix(9.0, 2.400000095367431640625, _118.uPerspective);
    float radius = (_118.uCorner * 0.716000020503997802734375) * 2.0;
    float4 acc = float4(0.0);
    float wide = 0.716000020503997802734375 * fast::max(abs(c_1), 0.039999999105930328369140625);
    float2 param = sp - float2(0.0, (-0.0599999986588954925537109375) - (0.100000001490116119384765625 * sn));
    float2 param_1 = float2(wide, 1.0);
    float param_2 = radius * abs(c_1);
    float shadowD = roundedBox(param, param_1, param_2);
    float shadow = ((1.0 - smoothstep((-0.07999999821186065673828125) - (0.100000001490116119384765625 * sn), 0.100000001490116119384765625 + (0.20000000298023223876953125 * sn), shadowD)) * _118.uShadow) * (0.5 - (0.20000000298023223876953125 * sn));
    float4 param_3 = acc;
    float3 param_4 = float3(0.0);
    float param_5 = shadow;
    acc = over(param_3, param_4, param_5);
    float side = (sn > 0.0) ? (-1.0) : 1.0;
    float zEdge = (side * 0.716000020503997802734375) * sn;
    float k = D / (D + zEdge);
    float edgeX = ((side * 0.716000020503997802734375) * c_1) * k;
    float edgeW = ((0.02199999988079071044921875 * abs(sn)) * k) + (0.5 / unit);
    float edge = (1.0 - smoothstep(edgeW - (1.0 / unit), edgeW, abs(sp.x - edgeX))) * (1.0 - smoothstep(k - (1.0 / unit), k, abs(sp.y)));
    float4 param_6 = acc;
    float3 param_7 = float3(_118.uEdge) * (0.75 + (0.25 * sn));
    float param_8 = edge * smoothstep(0.0199999995529651641845703125, 0.1500000059604644775390625, abs(sn));
    acc = over(param_6, param_7, param_8);
    float den = (D * c_1) - (sp.x * sn);
    if (abs(den) > 9.9999997473787516355514526367188e-05)
    {
        float t = (D * c_1) / den;
        float2 local = float2(((t * sp.x) * c_1) + (((D * t) - D) * sn), t * sp.y);
        bool front = c_1 > 0.0;
        if (!front)
        {
            local.x = -local.x;
        }
        float2 param_9 = local;
        float2 param_10 = float2(0.716000020503997802734375, 1.0);
        float param_11 = radius;
        float sd = roundedBox(param_9, param_10, param_11);
        float mask = (1.0 - smoothstep(-fwidth(sd), fwidth(sd), sd)) * step(0.0, t);
        if (mask > 0.0)
        {
            float2 cuv = ((local / float2(0.716000020503997802734375, 1.0)) * 0.5) + float2(0.5);
            float3 _666;
            if (front)
            {
                float2 param_12 = cuv;
                float param_13 = 0.716000020503997802734375;
                _666 = face(uFront, uFrontSmplr, param_12, param_13, _118);
            }
            else
            {
                float2 param_14 = cuv;
                float param_15 = 0.716000020503997802734375;
                _666 = face(uBack, uBackSmplr, param_14, param_15, _118);
            }
            float3 col = _666;
            col *= (0.60000002384185791015625 + (0.4000000059604644775390625 * abs(c_1)));
            float _691;
            if (front)
            {
                _691 = p;
            }
            else
            {
                _691 = 1.0 - p;
            }
            float sweep = (_691 * 1.7999999523162841796875) - 0.4000000059604644775390625;
            col += float3(((_118.uShine * 0.60000002384185791015625) * sn) * exp((-powr(((cuv.x * 0.800000011920928955078125) + (cuv.y * 0.300000011920928955078125)) - sweep, 2.0)) * 22.0));
            float rim = smoothstep((-0.0199999995529651641845703125) - fwidth(sd), -0.0199999995529651641845703125, sd);
            col = mix(col, float3(_118.uEdge), float3(rim * 0.800000011920928955078125));
            float4 param_16 = acc;
            float3 param_17 = fast::clamp(col, float3(0.0), float3(1.0));
            float param_18 = mask;
            acc = over(param_16, param_17, param_18);
        }
    }
    float4 param_19 = acc;
    fragColor = unpremultiply(param_19);
}

fragment flair_card_flip_frag_out flair_card_flip_frag(constant FlairUniforms& _118 [[buffer(0)]], texture2d<float> uFront [[texture(1)]], texture2d<float> uBack [[texture(2)]], sampler uFrontSmplr [[sampler(1)]], sampler uBackSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_card_flip_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _767;
    if (_118.flair_flipY > 0.5)
    {
        _767 = _118.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _767 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _767);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _118, uFront, uFrontSmplr, uBack, uBackSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

