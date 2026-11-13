// flair-metal-hash: b0f40ba2
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float3 uInk;
    packed_float3 uPaper;
    float uThreshold;
    float uHardness;
    float uGrain;
    float uStreaks;
    float uEdge;
    float uJitter;
    char _m21_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_photocopy_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
    bool _349 = _178.uJitter > 0.0;
    bool _357;
    if (!_349)
    {
        _357 = _178.uGrain > 0.0;
    }
    else
    {
        _357 = _349;
    }
    float _358;
    if (_357)
    {
        _358 = floor(_178.iTime * 8.0);
    }
    else
    {
        _358 = 0.0;
    }
    float copy = _358;
    float2 param = float2(copy, 3.0);
    float2 shift = ((hash22(param) - float2(0.5)) * 0.006000000052154064178466796875) * _178.uJitter;
    float2 param_1 = float2(copy, 9.0);
    float skew = ((hash12(param_1) - 0.5) * 0.01200000010430812835693359375) * _178.uJitter;
    float2 param_2 = (uv + shift) + float2((uv.y - 0.5) * skew, 0.0);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_2, _178);
    float l = dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float2 param_3 = floor(fragCoord / float2(2.0)) + float2(copy * 17.0);
    float speckle = hash12(param_3) - 0.5;
    float2 param_4 = (fragCoord / float2(9.0)) + float2(copy * 3.099999904632568359375);
    float clump = vnoise(param_4) - 0.5;
    l += (_178.uGrain * ((0.300000011920928955078125 * speckle) + (0.300000011920928955078125 * clump)));
    float2 param_5 = float2(uv.x * 60.0, copy * 0.37000000476837158203125);
    l += ((_178.uStreaks * 0.5) * smoothstep(0.7799999713897705078125, 0.9700000286102294921875, vnoise(param_5)));
    float2 param_6 = float2((uv.x * 23.0) + 40.0, copy * 0.20999999344348907470703125);
    l -= ((_178.uStreaks * 0.300000011920928955078125) * smoothstep(0.75, 0.980000019073486328125, vnoise(param_6)));
    float2 margin = fast::min(uv, float2(1.0) - uv);
    float2 param_7 = uv * 14.0;
    l -= ((_178.uEdge * 0.89999997615814208984375) * smoothstep(0.0500000007450580596923828125, 0.0, fast::min(margin.x, margin.y) + (0.02999999932944774627685546875 * (vnoise(param_7) - 0.5))));
    float w = 0.5 / _178.uHardness;
    float toner = 1.0 - smoothstep(_178.uThreshold - w, _178.uThreshold + w, l);
    float2 param_8 = floor(fragCoord / float2(3.0)) + float2(copy * 5.0);
    toner = fast::max(toner, _178.uGrain * step(0.99849998950958251953125, hash12(param_8)));
    fragColor = float4(mix(float3(_178.uPaper), _178.uInk, float3(toner)), pic.w);
}

fragment flair_image_photocopy_frag_out flair_image_photocopy_frag(constant FlairUniforms& _178 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_photocopy_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _579;
    if (_178.flair_flipY > 0.5)
    {
        _579 = _178.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _579 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _579);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _178, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

