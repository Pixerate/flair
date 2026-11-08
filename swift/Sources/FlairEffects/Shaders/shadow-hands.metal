// flair-metal-hash: cccc9f3b
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    packed_float3 uShadow;
    float uDarkness;
    float uSoftness;
    float uSize;
    float uHands;
    float uCycle;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_shadow_hands_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _71)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_71.uBackdrop) * _71.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_71.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _71)
{
    float4 _215;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _215 = overBackdrop(param, _71);
    }
    else
    {
        float2 param_1 = fract(uv);
        _215 = float4(testCard(param_1), 1.0);
    }
    return _215;
}

static inline __attribute__((always_inline))
float capsule(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& r)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0))) - r;
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float hand(thread const float2& q, thread const float& curl, constant FlairUniforms& _71)
{
    float2 param = q;
    float2 param_1 = float2(-3.0, 0.0);
    float2 param_2 = float2(0.0);
    float param_3 = 0.100000001490116119384765625;
    float d = capsule(param, param_1, param_2, param_3);
    float2 b = abs(q - float2(0.119999997317790985107421875, 0.0)) - float2(0.119999997317790985107421875, 0.10999999940395355224609375);
    float param_4 = d;
    float param_5 = (length(fast::max(b, float2(0.0))) + fast::min(fast::max(b.x, b.y), 0.0)) - 0.039999999105930328369140625;
    float param_6 = 0.0500000007450580596923828125;
    d = smin(param_4, param_5, param_6);
    for (int i = 0; i < 4; i++)
    {
        float fi = float(i);
        float spread = (fi - 1.5) * (0.1599999964237213134765625 - (0.100000001490116119384765625 * curl));
        float len = (((fi == 0.0) || (fi == 3.0)) ? 0.20000000298023223876953125 : 0.25) * (1.0 - (0.1500000059604644775390625 * curl));
        float2 base = float2(0.2599999904632568359375, (fi - 1.5) * 0.06800000369548797607421875);
        float a1 = spread;
        float2 j1 = base + (float2(cos(a1), sin(a1)) * len);
        float a2 = (a1 - ((0.3499999940395355224609375 * curl) * sign(fi - 1.5))) + (0.119999997317790985107421875 * sin((_71.iTime * 3.0) + (fi * 1.7000000476837158203125)));
        float2 j2 = j1 + (float2(cos(a2), sin(a2)) * ((0.85000002384185791015625 * len) * (1.0 - (0.64999997615814208984375 * curl))));
        float2 param_7 = q;
        float2 param_8 = base;
        float2 param_9 = j1;
        float param_10 = 0.02999999932944774627685546875;
        float param_11 = d;
        float param_12 = capsule(param_7, param_8, param_9, param_10);
        float param_13 = 0.02999999932944774627685546875;
        d = smin(param_11, param_12, param_13);
        float2 param_14 = q;
        float2 param_15 = j1;
        float2 param_16 = j2;
        float param_17 = 0.0240000002086162567138671875;
        float param_18 = d;
        float param_19 = capsule(param_14, param_15, param_16, param_17);
        float param_20 = 0.0199999995529651641845703125;
        d = smin(param_18, param_19, param_20);
    }
    float2 t1 = float2(0.100000001490116119384765625, 0.119999997317790985107421875);
    float2 t2 = t1 + float2(0.100000001490116119384765625, 0.100000001490116119384765625 - (0.07999999821186065673828125 * curl));
    float2 param_21 = q;
    float2 param_22 = t1;
    float2 param_23 = t2;
    float param_24 = 0.034000001847743988037109375;
    float param_25 = d;
    float param_26 = capsule(param_21, param_22, param_23, param_24);
    float param_27 = 0.039999999105930328369140625;
    d = smin(param_25, param_26, param_27);
    float2 param_28 = q;
    float2 param_29 = t2;
    float2 param_30 = t2 + float2(0.100000001490116119384765625, 0.0199999995529651641845703125 - (0.0599999986588954925537109375 * curl));
    float param_31 = 0.0280000008642673492431640625;
    float param_32 = d;
    float param_33 = capsule(param_28, param_29, param_30, param_31);
    float param_34 = 0.0199999995529651641845703125;
    d = smin(param_32, param_33, param_34);
    return d;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _71, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_71.iResolution[0], _71.iResolution[1]);
    float aspect = _71.iResolution[0u] / _71.iResolution[1u];
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _71);
    float2 p = (fragCoord - (float2(_71.iResolution[0], _71.iResolution[1]) * 0.5)) / float2(_71.iResolution[1u]);
    float S = 0.449999988079071044921875 * _71.uSize;
    float shade = 0.0;
    int n = int(_71.uHands + 0.5);
    float2 _548;
    float2 _558;
    float2 _574;
    for (int i = 0; i < 3; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        if (i == 0)
        {
            _548 = float2((-0.5) * aspect, 0.119999997317790985107421875);
        }
        else
        {
            if (i == 1)
            {
                _558 = float2(0.5 * aspect, -0.07999999821186065673828125);
            }
            else
            {
                _558 = float2(0.1500000059604644775390625 * aspect, -0.5);
            }
            _548 = _558;
        }
        float2 from = _548;
        if (i == 0)
        {
            _574 = float2(1.0, -0.25);
        }
        else
        {
            _574 = select(float2(-0.20000000298023223876953125, 1.0), float2(-1.0, 0.300000011920928955078125), bool2(i == 1));
        }
        float2 dir = fast::normalize(_574);
        float u = fract((_71.iTime / _71.uCycle) - (fi / 3.0));
        float reach = smoothstep(0.0, 0.4000000059604644775390625, u) * (1.0 - smoothstep(0.62000000476837158203125, 0.949999988079071044921875, u));
        float curl = smoothstep(0.3499999940395355224609375, 0.5, u) * (1.0 - smoothstep(0.579999983310699462890625, 0.699999988079071044921875, u));
        float2 palm = from + (((dir * ((reach * 0.75) - 0.449999988079071044921875)) * S) / float2(0.449999988079071044921875));
        float2 q = p - palm;
        float2 h = float2(dot(q, dir), dot(q, float2(-dir.y, dir.x))) / float2(S);
        if (i == 1)
        {
            h.y = -h.y;
        }
        float2 param_1 = h;
        float param_2 = curl;
        float d = hand(param_1, param_2, _71) * S;
        float soft = 0.00200000009499490261077880859375 + (0.02999999932944774627685546875 * _71.uSoftness);
        shade = fast::max(shade, smoothstep(soft, -soft, d));
    }
    float3 col = mix(pic.xyz, (pic.xyz * float3(_71.uShadow)) * 4.0, float3(shade * _71.uDarkness));
    col = mix(col, float3(_71.uShadow), float3((shade * _71.uDarkness) * 0.60000002384185791015625));
    fragColor = float4(col, fast::max(pic.w, shade * _71.uDarkness));
}

fragment flair_shadow_hands_frag_out flair_shadow_hands_frag(constant FlairUniforms& _71 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_shadow_hands_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _737;
    if (_71.flair_flipY > 0.5)
    {
        _737 = _71.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _737 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _737);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _71, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

