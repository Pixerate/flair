// flair-metal-hash: 48656674
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
    int uCount;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    float uIntensity;
    float uSpeed;
    float uPoolSize;
    float uBeams;
    float uDarken;
    float uSparkle;
    float uStrobe;
    char _m24_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_party_lights_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 lightColour(thread const int& i, thread const float& t, constant FlairUniforms& _68)
{
    int k = int(mod(float(i) + floor(t * 0.25), 3.0));
    float3 _290;
    if (k == 0)
    {
        _290 = _68.uColorA;
    }
    else
    {
        float3 _299;
        if (k == 1)
        {
            _299 = _68.uColorB;
        }
        else
        {
            _299 = float3(_68.uColorC);
        }
        _290 = _299;
    }
    return _290;
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _68)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_68.uBackdrop) * _68.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_68.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    float4 _212;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _212 = overBackdrop(param, _68);
    }
    else
    {
        float2 param_1 = fract(uv);
        _212 = float4(testCard(param_1), 1.0);
    }
    return _212;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _68, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_68.iResolution[0], _68.iResolution[1]);
    float2 p = (fragCoord - (float2(_68.iResolution[0], _68.iResolution[1]) * 0.5)) / float2(_68.iResolution[1u]);
    float aspect = _68.iResolution[0u] / _68.iResolution[1u];
    float t = _68.iTime * _68.uSpeed;
    float3 light = float3(0.0);
    float3 haze = float3(0.0);
    for (int i = 0; i < 8; i++)
    {
        if (i >= _68.uCount)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi, 4.19999980926513671875);
        float h = hash12(param);
        float2 src = float2(((((fi + 0.5) / float(_68.uCount)) - 0.5) * aspect) * 0.89999997615814208984375, 0.62000000476837158203125);
        float2 pool = float2((sin((t * (0.5 + (0.4000000059604644775390625 * h))) + (fi * 2.099999904632568359375)) * 0.449999988079071044921875) * aspect, (-0.100000001490116119384765625) + (0.300000011920928955078125 * sin((t * (0.37000000476837158203125 + (0.300000011920928955078125 * h))) + (fi * 1.2999999523162841796875))));
        int param_1 = i;
        float param_2 = t + fi;
        float3 c = lightColour(param_1, param_2, _68);
        float size = _68.uPoolSize * (0.800000011920928955078125 + (0.4000000059604644775390625 * h));
        float d = length((p - pool) * float2(1.0, 1.2999999523162841796875));
        light += (c * ((smoothstep(size, size * 0.550000011920928955078125, d) * 0.800000011920928955078125) + (exp(((-d) * d) / (size * size)) * 0.5)));
        float2 ab = pool - src;
        float s = fast::clamp(dot(p - src, ab) / dot(ab, ab), 0.0, 1.0);
        float w = mix(0.008000000379979610443115234375, size * 0.89999997615814208984375, s);
        float cone = (smoothstep(w, w * 0.20000000298023223876953125, length((p - src) - (ab * s))) * s) * s;
        haze += (c * cone);
    }
    float param_3 = t * 0.1500000059604644775390625;
    float2 g = (rot(param_3) * (p + float2(0.0, 0.60000002384185791015625))) * 22.0;
    float2 cell = floor(g);
    float2 param_4 = cell;
    float dotLit = step(0.939999997615814208984375, hash12(param_4)) * smoothstep(0.2199999988079071044921875, 0.0500000007450580596923828125, length(fract(g) - float2(0.5)));
    float2 param_5 = cell + float2(1.7000000476837158203125);
    float twinkle = 0.5 + (0.5 * sin((_68.iTime * 6.0) + (hash12(param_5) * 20.0)));
    float2 param_6 = cell + float2(2.2999999523162841796875);
    int param_7 = int(hash12(param_6) * 3.0);
    float param_8 = t;
    float3 sparkle = ((mix(float3(1.0), lightColour(param_7, param_8, _68), float3(0.5)) * dotLit) * twinkle) * _68.uSparkle;
    float2 param_9 = float2(floor(_68.iTime * 1.5), 9.0);
    float burst = step(1.0 - (_68.uStrobe * 0.60000002384185791015625), hash12(param_9));
    float strobe = (_68.uStrobe * burst) * step(0.60000002384185791015625, fract(_68.iTime * 9.0));
    float2 param_10 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_10, _68);
    float3 room = pic.xyz * (1.0 - _68.uDarken);
    float3 col = (room + (((pic.xyz * (light + sparkle)) * _68.uIntensity) * 1.39999997615814208984375)) + ((((light * 0.07999999821186065673828125) + ((haze * _68.uBeams) * 0.60000002384185791015625)) + (sparkle * 0.4000000059604644775390625)) * _68.uIntensity);
    col += (mix(float3(0.4000000059604644775390625), float3(1.0), pic.xyz) * strobe);
    fragColor = float4(col / (float3(1.0) + fast::max(col - float3(1.0), float3(0.0))), pic.w);
}

fragment flair_party_lights_frag_out flair_party_lights_frag(constant FlairUniforms& _68 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_party_lights_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _686;
    if (_68.flair_flipY > 0.5)
    {
        _686 = _68.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _686 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _686);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _68, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

