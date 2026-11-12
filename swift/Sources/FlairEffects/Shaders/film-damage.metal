// flair-metal-hash: 7a39e1da
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uScratches;
    float uDust;
    float uBlotches;
    float uFlicker;
    float uJumps;
    uint uCueMarks;
    float uFade;
    float uGrain;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_film_damage_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _178)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_178.uBackdrop) * _178.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_178.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _178)
{
    float4 _319;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _319 = overBackdrop(param, _178);
    }
    else
    {
        float2 param_1 = fract(uv);
        _319 = float4(testCard(param_1), 1.0);
    }
    return _319;
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _178, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_178.iResolution[0], _178.iResolution[1]);
    float aspect = _178.iResolution[0u] / _178.iResolution[1u];
    float px = 1.0 / _178.iResolution[1u];
    float frame = floor(_178.iTime * 24.0);
    float seg = floor(_178.iTime * 2.0);
    float into = frame - floor(seg * 12.0);
    float2 param = float2(seg, 5.0);
    float jump = step(hash12(param), _178.uJumps * 0.449999988079071044921875) * step(into, 2.0);
    float2 param_1 = float2(seg, 6.0);
    float offset = (jump * (hash12(param_1) - 0.5)) * 0.5;
    float2 param_2 = float2(frame, 1.0);
    float2 weave = (hash22(param_2) - float2(0.5)) * float2(0.00200000009499490261077880859375, 0.0030000000260770320892333984375);
    float v = fract((uv.y + offset) + weave.y);
    float2 param_3 = float2(uv.x + weave.x, v);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_3, _178);
    float3 col = pic.xyz;
    float line = jump * (1.0 - smoothstep(0.0, 0.0199999995529651641845703125, fast::min(v, 1.0 - v)));
    col = mix(col, float3(0.0199999995529651641845703125), float3(line));
    col = mix(col, (col * float3(1.059999942779541015625, 0.839999973773956298828125, 0.87999999523162841796875)) + float3(0.070000000298023223876953125, 0.02999999932944774627685546875, 0.0500000007450580596923828125), float3(_178.uFade));
    col = mix(col, float3(0.550000011920928955078125), float3(0.180000007152557373046875 * _178.uFade));
    float2 param_4 = float2(frame, 2.0);
    col *= (1.0 + ((_178.uFlicker * (hash12(param_4) - 0.5)) * 0.2800000011920928955078125));
    float2 p = float2(uv.x * aspect, uv.y);
    for (int i = 0; i < 4; i++)
    {
        float fi = float(i);
        float life = floor(frame / (14.0 + (9.0 * fi)));
        float2 param_5 = float2(life, fi + 10.0);
        if (hash12(param_5) > _178.uScratches)
        {
            continue;
        }
        float2 param_6 = float2(life, fi + 20.0);
        float2 param_7 = float2(frame, fi + 30.0);
        float x = ((hash12(param_6) * aspect) + ((hash12(param_7) - 0.5) * 0.0040000001899898052215576171875)) + (0.0030000000260770320892333984375 * sin((uv.y * 9.0) + fi));
        float2 param_8 = float2(life, fi + 40.0);
        float top = hash12(param_8);
        float span = step(uv.y, fast::max(top, 0.60000002384185791015625)) * step(fast::min(top, 0.4000000059604644775390625) - 0.4000000059604644775390625, uv.y);
        float2 param_9 = float2(frame, fi + 50.0);
        float s = ((1.0 - smoothstep(0.0, (0.800000011920928955078125 + (fi * 0.4000000059604644775390625)) * px, abs(p.x - x))) * span) * (0.5 + (0.5 * hash12(param_9)));
        float2 param_10 = float2(life, fi + 60.0);
        col = mix(col, select(float3(0.0500000007450580596923828125), float3(0.949999988079071044921875), bool3(hash12(param_10) > 0.3499999940395355224609375)), float3(0.75 * s));
    }
    for (int i_1 = 0; i_1 < 6; i_1++)
    {
        float fi_1 = float(i_1);
        float2 param_11 = float2(frame, fi_1 + 70.0);
        if (hash12(param_11) > _178.uDust)
        {
            continue;
        }
        float2 param_12 = float2(frame, fi_1 * 3.7000000476837158203125);
        float2 c = hash22(param_12) * float2(aspect, 1.0);
        float2 param_13 = float2(frame, fi_1 + 80.0);
        float r = 0.00200000009499490261077880859375 + (0.007000000216066837310791015625 * hash12(param_13));
        float2 d = p - c;
        float2 param_14 = float2(precise::atan2(d.y, d.x) * 2.0, fi_1 + frame);
        float rough = r * (0.699999988079071044921875 + (0.60000002384185791015625 * vnoise(param_14)));
        float speck = 1.0 - smoothstep(rough - px, rough + px, length(d));
        float2 param_15 = float2(frame, fi_1 + 90.0);
        col = mix(col, select(float3(0.02999999932944774627685546875), float3(0.89999997615814208984375), bool3(hash12(param_15) > 0.800000011920928955078125)), float3(0.85000002384185791015625 * speck));
    }
    float2 param_16 = float2(frame, 100.0);
    if (hash12(param_16) < (_178.uDust * 0.119999997317790985107421875))
    {
        float2 param_17 = float2(frame, 101.0);
        float2 c_1 = hash22(param_17) * float2(aspect, 1.0);
        float2 param_18 = float2(frame, 102.0);
        float a = hash12(param_18) * 6.28318023681640625;
        float2 d_1 = float2x2(float2(cos(a), sin(a)), float2(-sin(a), cos(a))) * (p - c_1);
        float hair = abs((d_1.y - (0.02500000037252902984619140625 * sin(d_1.x * 38.0))) - ((0.4000000059604644775390625 * d_1.x) * d_1.x));
        col = mix(col, float3(0.02999999932944774627685546875), float3((0.800000011920928955078125 * (1.0 - smoothstep(0.0, 1.5 * px, hair))) * step(abs(d_1.x), 0.0900000035762786865234375)));
    }
    float2 param_19 = float2(frame, 110.0);
    if (hash12(param_19) < (_178.uBlotches * 0.25))
    {
        float2 param_20 = float2(frame, 111.0);
        float2 c_2 = hash22(param_20) * float2(aspect, 1.0);
        float2 param_21 = ((p - c_2) * 14.0) + float2(frame);
        float blob = smoothstep(0.550000011920928955078125, 0.62000000476837158203125, (vnoise(param_21) * (1.0 - smoothstep(0.02999999932944774627685546875, 0.119999997317790985107421875, length(p - c_2)))) * 1.60000002384185791015625);
        col = mix(col, float3(0.920000016689300537109375, 0.86000001430511474609375, 0.7200000286102294921875), float3(0.699999988079071044921875 * blob));
    }
    float cycle = mod(_178.iTime, 10.0);
    bool _867 = _178.uCueMarks != 0u;
    bool _884;
    if (_867)
    {
        bool _872 = cycle < 0.16666667163372039794921875;
        bool _883;
        if (!_872)
        {
            _883 = abs((cycle - 7.0) - 0.083333335816860198974609375) < 0.083333335816860198974609375;
        }
        else
        {
            _883 = _872;
        }
        _884 = _883;
    }
    else
    {
        _884 = _867;
    }
    if (_884)
    {
        float d_2 = length(p - float2(aspect - 0.119999997317790985107421875, 0.86000001430511474609375));
        col = mix(col, float3(0.039999999105930328369140625), float3(1.0 - smoothstep(0.0240000002086162567138671875, 0.0240000002086162567138671875 + px, d_2)));
        col = mix(col, float3(0.85000002384185791015625), float3((1.0 - smoothstep(0.0, 1.5 * px, abs(d_2 - 0.026000000536441802978515625))) * 0.800000011920928955078125));
    }
    float2 param_22 = fragCoord + (float2(17.3099994659423828125, 31.729999542236328125) * frame);
    col += float3(((hash12(param_22) - 0.5) * 0.14000000059604644775390625) * _178.uGrain);
    col *= (1.0 - (0.300000011920928955078125 * smoothstep(0.449999988079071044921875, 0.949999988079071044921875, length((uv - float2(0.5)) * float2(aspect / 1.2999999523162841796875, 1.0)))));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_film_damage_frag_out flair_film_damage_frag(constant FlairUniforms& _178 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_film_damage_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _973;
    if (_178.flair_flipY > 0.5)
    {
        _973 = _178.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _973 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _973);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _178, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

