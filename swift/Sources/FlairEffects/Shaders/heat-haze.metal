// flair-metal-hash: dbfc470b
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
    float uStrength;
    float uScale;
    float uSpeed;
    float uHeight;
    packed_float3 uTint;
    float uWarmth;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_heat_haze_frag_out
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _204)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_204.uBackdrop) * _204.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_204.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _204)
{
    float4 _341;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _341 = overBackdrop(param, _204);
    }
    else
    {
        float2 param_1 = fract(uv);
        _341 = float4(testCard(param_1), 1.0);
    }
    return _341;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _204, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_204.iResolution[0], _204.iResolution[1]);
    float aspect = _204.iResolution[0u] / _204.iResolution[1u];
    float t = _204.iTime * _204.uSpeed;
    float heat = smoothstep(_204.uHeight, 0.0, uv.y);
    float2 q = float2((uv.x * aspect) * _204.uScale, ((uv.y * _204.uScale) * 1.60000002384185791015625) - (t * 1.39999997615814208984375));
    float2 param = q;
    int param_1 = 4;
    float _412 = fbm(param, param_1);
    float a = _412;
    float2 param_2 = (q + float2(5.19999980926513671875, 1.2999999523162841796875)) + float2(a);
    int param_3 = 4;
    float _424 = fbm(param_2, param_3);
    float b = _424;
    float2 off = float2(a - 0.5, b - 0.5) * 0.0500000007450580596923828125;
    off.x += (sin((((uv.y * _204.uScale) * 14.0) - (t * 5.0)) + (a * 6.0)) * 0.00999999977648258209228515625);
    off *= (_204.uStrength * heat);
    float2 st = uv + off;
    float fringe = 0.25 * length(off);
    float2 param_4 = st + float2(fringe, 0.0);
    float4 r = pictureRGBA(uImage, uImageSmplr, param_4, _204);
    float2 param_5 = st;
    float4 g = pictureRGBA(uImage, uImageSmplr, param_5, _204);
    float2 param_6 = st - float2(fringe, 0.0);
    float4 b2 = pictureRGBA(uImage, uImageSmplr, param_6, _204);
    float3 col = float3(r.x, g.y, b2.z);
    float alpha = fast::max(fast::max(r.w, g.w), b2.w);
    float y0 = 0.0500000007450580596923828125 + (0.1500000059604644775390625 * _204.uHeight);
    float below = smoothstep(y0, 0.0, uv.y) * (0.60000002384185791015625 + (0.4000000059604644775390625 * b));
    float2 param_7 = float2(st.x, (y0 + ((y0 - uv.y) * 1.39999997615814208984375)) + (off.y * 2.0));
    float4 mirage = pictureRGBA(uImage, uImageSmplr, param_7, _204);
    col = mix(col, mirage.xyz, float3((below * _204.uStrength) * 0.550000011920928955078125));
    alpha = mix(alpha, mirage.w, (below * _204.uStrength) * 0.550000011920928955078125);
    col = mix(col, col * mix(float3(1.0), float3(_204.uTint) * 1.35000002384185791015625, float3(_204.uWarmth)), float3(heat));
    col = mix(col, float3(_204.uTint), float3(((heat * _204.uWarmth) * 0.119999997317790985107421875) * (0.699999988079071044921875 + (0.60000002384185791015625 * a))));
    fragColor = float4(col, alpha);
}

fragment flair_heat_haze_frag_out flair_heat_haze_frag(constant FlairUniforms& _204 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_heat_haze_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _608;
    if (_204.flair_flipY > 0.5)
    {
        _608 = _204.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _608 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _608);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _204, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

